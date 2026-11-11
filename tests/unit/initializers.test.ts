import { describe, expect, it } from "vitest";

import { initializeArchitecture } from "../../frontend/components/architecture/architecture.js";
import { initializeFooter } from "../../frontend/components/footer/footer.js";
import { initializeFooterLinks } from "../../frontend/components/footer/links/footerLinks.js";
import { initializeHeader } from "../../frontend/components/header/header.js";
import { initializeHeaderLinks } from "../../frontend/components/header/links/links.js";
import { initializeHeaderProfile } from "../../frontend/components/header/profile/profile.js";

describe("static component initializers", () => {
	it("remain callable for component lifecycle composition", () => {
		expect(initializeArchitecture()).toBeUndefined();
		expect(initializeFooter()).toBeUndefined();
		expect(initializeFooterLinks()).toBeUndefined();
		expect(initializeHeader()).toBeUndefined();
		expect(initializeHeaderLinks()).toBeUndefined();
		expect(initializeHeaderProfile()).toBeUndefined();
	});
});
