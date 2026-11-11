import { cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { build, context, type BuildResult, type Plugin, type PluginBuild } from "esbuild";

const sourceRoot = process.env.SOURCE_ROOT ?? "/workspace";
const outputRoot = process.env.OUTPUT_ROOT ?? "/hot-reload";
const stagingRoot = join(outputRoot, ".staging");
const previousRoot = join(outputRoot, ".previous");

const copyHtml = async (source: string, destination: string) => {
	await mkdir(destination, { recursive: true });
	for (const entry of await readdir(source, { withFileTypes: true })) {
		const sourcePath = join(source, entry.name);
		const destinationPath = join(destination, entry.name);
		if (entry.isDirectory()) await copyHtml(sourcePath, destinationPath);
		else if (entry.name.endsWith(".html")) await cp(sourcePath, destinationPath);
	}
};

const collectWatchPaths = async (directory: string, watchFiles: string[], watchDirs: string[]) => {
	watchDirs.push(directory);
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) await collectWatchPaths(path, watchFiles, watchDirs);
		else watchFiles.push(path);
	}
};

const swapDirectory = async (name: string) => {
	const current = join(outputRoot, name);
	const previous = join(previousRoot, name);
	await rm(previous, { recursive: true, force: true });
	try {
		await rename(current, previous);
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
	}
	await rename(join(stagingRoot, name), current);
};

const compile = async (reason: string) => {
	await rm(stagingRoot, { recursive: true, force: true });
	await mkdir(join(stagingRoot, "frontend", "dist"), { recursive: true });
	await mkdir(join(stagingRoot, "handlers"), { recursive: true });
	await copyHtml(join(sourceRoot, "frontend"), join(stagingRoot, "frontend"));
	await Promise.all([
		build({
			entryPoints: [join(sourceRoot, "handlers", "index.ts")],
			bundle: true,
			platform: "node",
			format: "esm",
			target: "node24",
			legalComments: "none",
			outfile: join(stagingRoot, "handlers", "index.mjs"),
		}),
		build({
			entryPoints: [join(sourceRoot, "frontend", "index.ts")],
			bundle: true,
			format: "iife",
			target: "es2022",
			minify: true,
			legalComments: "none",
			outfile: join(stagingRoot, "frontend", "dist", "app.min.js"),
		}),
		build({
			entryPoints: [join(sourceRoot, "frontend", "index.css")],
			bundle: true,
			minify: true,
			legalComments: "none",
			outfile: join(stagingRoot, "frontend", "dist", "app.min.css"),
		}),
	]);
	await mkdir(previousRoot, { recursive: true });
	await swapDirectory("handlers");
	await swapDirectory("frontend");
	await rm(previousRoot, { recursive: true, force: true });
	console.log(`[dev] ${new Date().toISOString()} compiled ${reason}`);
};

let compiling = false;
let pending = false;

const schedule = async () => {
	pending = true;
	if (compiling) return;
	compiling = true;
	while (pending) {
		pending = false;
		try {
			await compile("source changes");
		} catch (error) {
			console.error("[dev] compilation failed", error);
		}
	}
	compiling = false;
};

const watchPlugin: Plugin = {
	name: "runtime-sources",
	setup(watchBuild: PluginBuild) {
		watchBuild.onResolve({ filter: /^runtime-sources$/ }, () => ({
			path: "runtime-sources",
			namespace: "runtime-watch",
		}));
		watchBuild.onLoad({ filter: /.*/, namespace: "runtime-watch" }, async () => {
			const watchFiles: string[] = [];
			const watchDirs: string[] = [];
			await collectWatchPaths(join(sourceRoot, "handlers"), watchFiles, watchDirs);
			await collectWatchPaths(join(sourceRoot, "frontend"), watchFiles, watchDirs);
			return { contents: "", loader: "js", watchFiles, watchDirs };
		});
		watchBuild.onEnd((result: BuildResult) => {
			if (result.errors.length === 0) void schedule();
		});
	},
};

const watcher = await context({
	entryPoints: ["runtime-sources"],
	bundle: true,
	write: false,
	logLevel: "silent",
	plugins: [watchPlugin],
});

await watcher.watch();
console.log("[dev] esbuild watching handlers/ and frontend/");

const stop = async () => {
	await watcher.dispose();
	process.exit(0);
};

process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
