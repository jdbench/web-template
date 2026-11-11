import { submitContact } from "../../utils/api.js";

const submit = async (event: SubmitEvent) => {
	event.preventDefault();

	const form = event.currentTarget as HTMLFormElement;
	const formResult = form.querySelector<HTMLElement>(".form-result");
	const submitButton = form.querySelector<HTMLButtonElement>("button[type='submit']");
	if (!formResult || !submitButton) return;

	submitButton.disabled = true;
	submitButton.textContent = "Sending...";
	formResult.textContent = "";

	try {
		const data = await submitContact(Object.fromEntries(new FormData(form)));
		form.reset();
		formResult.textContent = `Accepted / ${data.requestId.slice(0, 8)}`;
		formResult.dataset.state = "success";
	} catch (error) {
		formResult.textContent = error instanceof Error ? error.message : "Request failed.";
		formResult.dataset.state = "error";
	} finally {
		submitButton.disabled = false;
		submitButton.textContent = "Send request";
	}
};

export const initializeContactForm = () => {
	document.querySelector("[data-contact-form]")?.addEventListener("submit", (event) => {
		void submit(event as SubmitEvent);
	});
};
