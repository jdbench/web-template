import { getHealth } from "../../utils/api.js";

const setStatus = (label: string, detail: string, state: string) => {
	const statusDot = document.createElement("span");
	statusDot.className = `status-dot ${state}`;
	document.querySelector(".api-status")?.replaceChildren(statusDot, label);
	const detailElement = document.querySelector(".api-detail");
	if (detailElement) detailElement.textContent = detail;
};

export const checkHealth = async () => {
	const refreshButton = document.querySelector(".icon-button");
	refreshButton?.classList.add("spinning");
	setStatus("Checking", "Connecting to Lambda", "neutral");

	try {
		const data = await getHealth();
		const checkedAt = new Date(data.timestamp).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
		setStatus("Operational", `Last checked at ${checkedAt}`, "online");
	} catch (error) {
		setStatus(
			"Unavailable",
			error instanceof Error ? error.message : "Health check failed.",
			"offline",
		);
	} finally {
		refreshButton?.classList.remove("spinning");
	}
};
