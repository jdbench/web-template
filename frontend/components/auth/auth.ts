import {
	login,
	logout,
	register,
	restoreSession,
	updateProfileImage,
	type User,
} from "../../utils/api.js";

const tokenKey = "relay.session";
let currentUser: User | null = null;
let modalTrigger: HTMLElement | null = null;

type AuthMode = "login" | "register";

const select = <ElementType extends Element>(selector: string): ElementType => {
	const element = document.querySelector<ElementType>(selector);
	if (!element) throw new Error(`Missing required element: ${selector}`);
	return element;
};

const errorMessage = (error: unknown) =>
	error instanceof Error ? error.message : "Authentication failed.";

const elements = () => ({
	forms: select<HTMLElement>(".auth-forms"),
	user: select<HTMLElement>(".auth-user"),
	result: select<HTMLElement>(".auth-result"),
	dialog: select<HTMLDialogElement>("[data-auth-dialog]"),
	signInButton: select<HTMLButtonElement>(".header-sign-in"),
	name: select<HTMLElement>("[data-auth-name]"),
	email: select<HTMLElement>("[data-auth-email]"),
	avatarButton: select<HTMLButtonElement>("[data-avatar-button]"),
	avatarImage: select<HTMLImageElement>("[data-avatar-image]"),
	avatarInitial: select<HTMLElement>("[data-avatar-initial]"),
	avatarRemove: select<HTMLButtonElement>("[data-avatar-remove]"),
});

const showAvatar = (user: User | null) => {
	const ui = elements();
	const name = user?.name?.trim() || "";
	ui.signInButton.hidden = Boolean(user);
	ui.avatarButton.hidden = !user;
	ui.avatarInitial.textContent = Array.from(name)[0]?.toLocaleUpperCase() || "?";
	ui.avatarImage.hidden = !user?.profileImage;
	ui.avatarInitial.hidden = Boolean(user?.profileImage);
	ui.avatarRemove.hidden = !user?.profileImage;
	if (user?.profileImage) ui.avatarImage.src = user.profileImage;
	else ui.avatarImage.removeAttribute("src");
};

const openModal = (trigger: HTMLElement) => {
	const dialog = elements().dialog;
	if (dialog.open) return;
	modalTrigger = trigger;
	if (!currentUser) setMode("login");
	dialog.showModal();
	queueMicrotask(() => {
		const target = currentUser
			? dialog.querySelector<HTMLElement>("[data-avatar-change]")
			: dialog.querySelector<HTMLElement>("[data-auth-form]:not([hidden]) input");
		target?.focus();
	});
};

const closeModal = () => {
	const dialog = elements().dialog;
	const trigger = modalTrigger;
	modalTrigger = null;
	dialog.close();
	trigger?.focus();
};

const showUser = (user: User) => {
	const ui = elements();
	currentUser = user;
	ui.forms.hidden = true;
	ui.user.hidden = false;
	ui.name.textContent = user.name;
	ui.email.textContent = user.email;
	showAvatar(user);
};

const showForms = () => {
	const ui = elements();
	currentUser = null;
	ui.forms.hidden = false;
	ui.user.hidden = true;
	showAvatar(null);
};

const resizeImage = async (file: File) => {
	if (!file.type.match(/^image\/(png|jpeg|webp)$/) || file.size > 5 * 1024 * 1024) {
		throw new Error("Choose a PNG, JPEG, or WebP image up to 5 MB.");
	}

	const source = await createImageBitmap(file);
	const side = Math.min(source.width, source.height);
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 256;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Image processing is unavailable.");
	context.drawImage(
		source,
		(source.width - side) / 2,
		(source.height - side) / 2,
		side,
		side,
		0,
		0,
		256,
		256,
	);
	source.close();
	return canvas.toDataURL("image/webp", 0.8);
};

const setMode = (mode: AuthMode) => {
	document.querySelectorAll<HTMLElement>("[data-auth-form]").forEach((form) => {
		form.hidden = form.dataset.authForm !== mode;
	});
	document.querySelectorAll<HTMLButtonElement>("[data-auth-mode]").forEach((button) => {
		const active = button.dataset.authMode === mode;
		button.classList.toggle("active", active);
		button.setAttribute("aria-selected", String(active));
		button.tabIndex = active ? 0 : -1;
	});
};

const submit = async (event: SubmitEvent) => {
	event.preventDefault();
	const form = event.currentTarget as HTMLFormElement;
	const button = form.querySelector<HTMLButtonElement>("button[type='submit']");
	const result = select<HTMLElement>(".auth-result");
	const action = form.dataset.authForm as AuthMode;
	if (!button) return;
	button.disabled = true;
	result.textContent = "";

	try {
		const payload = Object.fromEntries(new FormData(form));
		const session = action === "register" ? await register(payload) : await login(payload);
		sessionStorage.setItem(tokenKey, session.token);
		form.reset();
		showUser(session.user);
		result.textContent = action === "register" ? "Account created." : "Signed in.";
		result.dataset.state = "success";
	} catch (error) {
		result.textContent = errorMessage(error);
		result.dataset.state = "error";
	} finally {
		button.disabled = false;
	}
};

export const initializeAuth = async () => {
	const dialog = select<HTMLDialogElement>("[data-auth-dialog]");
	document.querySelectorAll<HTMLElement>("[data-auth-open]").forEach((button) => {
		button.addEventListener("click", () => openModal(button));
	});
	document.querySelector("[data-auth-close]")?.addEventListener("click", closeModal);
	dialog.addEventListener("cancel", (event) => {
		event.preventDefault();
		closeModal();
	});
	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) closeModal();
	});
	document.querySelectorAll<HTMLButtonElement>("[data-auth-mode]").forEach((button) => {
		button.addEventListener("click", () => setMode(button.dataset.authMode as AuthMode));
		button.addEventListener("keydown", (event) => {
			const tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-auth-mode]")];
			const currentIndex = tabs.indexOf(button);
			const nextIndex =
				event.key === "Home"
					? 0
					: event.key === "End"
						? tabs.length - 1
						: event.key === "ArrowRight"
							? (currentIndex + 1) % tabs.length
							: event.key === "ArrowLeft"
								? (currentIndex - 1 + tabs.length) % tabs.length
								: null;
			if (nextIndex === null) return;
			event.preventDefault();
			const nextTab = tabs[nextIndex];
			if (!nextTab) return;
			setMode(nextTab.dataset.authMode as AuthMode);
			nextTab.focus();
		});
	});
	document.querySelectorAll<HTMLFormElement>("[data-auth-form]").forEach((form) => {
		form.addEventListener("submit", (event) => void submit(event));
	});
	document
		.querySelector("[data-avatar-change]")
		?.addEventListener("click", () => select<HTMLInputElement>("[data-avatar-input]").click());
	document.querySelector("[data-avatar-input]")?.addEventListener(
		"change",
		(event) =>
			void (async () => {
				const input = event.currentTarget as HTMLInputElement;
				const file = input.files?.[0];
				if (!file) return;
				const result = select<HTMLElement>(".auth-result");
				try {
					const profileImage = await resizeImage(file);
					const token = sessionStorage.getItem(tokenKey);
					if (!token) throw new Error("Session is unavailable.");
					const session = await updateProfileImage(token, profileImage);
					showUser(session.user);
					result.textContent = "Profile image updated.";
					result.dataset.state = "success";
				} catch (error) {
					result.textContent = errorMessage(error);
					result.dataset.state = "error";
				} finally {
					input.value = "";
				}
			})(),
	);
	document.querySelector("[data-avatar-remove]")?.addEventListener(
		"click",
		() =>
			void (async () => {
				const result = select<HTMLElement>(".auth-result");
				try {
					const token = sessionStorage.getItem(tokenKey);
					if (!token) throw new Error("Session is unavailable.");
					const session = await updateProfileImage(token, null);
					showUser(session.user);
					result.textContent = "Profile image removed.";
					result.dataset.state = "success";
				} catch (error) {
					result.textContent = errorMessage(error);
					result.dataset.state = "error";
				}
			})(),
	);
	document.querySelector("[data-auth-logout]")?.addEventListener(
		"click",
		() =>
			void (async () => {
				const token = sessionStorage.getItem(tokenKey);
				if (token) await logout(token);
				sessionStorage.removeItem(tokenKey);
				showForms();
				select<HTMLElement>(".auth-result").textContent = "Signed out.";
			})(),
	);

	const token = sessionStorage.getItem(tokenKey);
	if (!token) return;

	try {
		const session = await restoreSession(token);
		showUser(session.user);
	} catch {
		sessionStorage.removeItem(tokenKey);
		showForms();
	}
};
