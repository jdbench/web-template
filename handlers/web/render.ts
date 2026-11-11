import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = process.env.LAMBDA_TASK_ROOT
	? resolve(process.env.LAMBDA_TASK_ROOT, "frontend")
	: resolve(dirname(fileURLToPath(import.meta.url)), "../../frontend");
const assetRoot = resolve(frontendRoot, "dist");

const templatePaths = {
	layout: "index.html",
	header: "components/header/header.html",
	headerLinks: "components/header/links/links.html",
	headerProfile: "components/header/profile/profile.html",
	footer: "components/footer/footer.html",
	footerLinks: "components/footer/links/footerLinks.html",
	overview: "pages/overview/overview.html",
	serviceStatus: "components/service-status/serviceStatus.html",
	contactForm: "components/contact-form/contactForm.html",
	architecture: "components/architecture/architecture.html",
	authPanel: "components/auth/auth.html",
};

const readTemplate = (path: string) => readFile(resolve(frontendRoot, path), "utf8");

type TemplateName = keyof typeof templatePaths;
const templates = {} as Record<TemplateName, string>;
await Promise.all(
	(Object.entries(templatePaths) as [TemplateName, string][]).map(async ([name, path]) => {
		templates[name] = await readTemplate(path);
	}),
);

const compose = (template: string, values: Record<string, string>) =>
	Object.entries(values).reduce(
		(result, [name, value]) => result.replaceAll(`{{${name}}}`, value),
		template,
	);

const minifyHtml = (html: string) =>
	html
		.replace(/>\s+</g, "><")
		.replace(/\s{2,}/g, " ")
		.trim();

export const renderOverview = () => {
	const header = compose(templates.header, {
		HEADER_LINKS: templates.headerLinks,
		HEADER_PROFILE: templates.headerProfile,
	});
	const footer = compose(templates.footer, { FOOTER_LINKS: templates.footerLinks });
	const page = compose(templates.overview, {
		SERVICE_STATUS: templates.serviceStatus,
		AUTH_PANEL: templates.authPanel,
		CONTACT_FORM: templates.contactForm,
		ARCHITECTURE: templates.architecture,
	});

	return minifyHtml(compose(templates.layout, { HEADER: header, PAGE: page, FOOTER: footer }));
};

const publicAssets: Record<string, string> = {
	"app.min.css": "text/css; charset=utf-8",
	"app.min.js": "text/javascript; charset=utf-8",
};

export const readAsset = async (assetPath: string) => {
	const assetName = decodeURIComponent(assetPath).replace(/^\/+/, "");
	const contentType = publicAssets[assetName];
	if (!contentType) return null;

	try {
		return { body: await readFile(resolve(assetRoot, assetName), "utf8"), contentType };
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
		throw error;
	}
};
