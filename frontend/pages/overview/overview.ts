import { initializeContactForm } from "../../components/contact-form/contactForm.js";
import { checkHealth } from "../../components/service-status/serviceStatus.js";

export const initializeOverview = () => {
	document.querySelector(".icon-button")?.addEventListener("click", () => void checkHealth());
	initializeContactForm();
	void checkHealth();
};
