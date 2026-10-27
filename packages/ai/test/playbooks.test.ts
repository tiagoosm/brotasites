import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkStyle, parsePlaybook, playbookFamilies, playbookFor } from "../src/index.js";

describe("playbooks", () => {
  it("has a versioned playbook per family of this round, plus the common rules", () => {
    for (const family of playbookFamilies) {
      const playbook = playbookFor(family);
      expect(playbook.version).toBe(`${family}@1+common@1`);
      expect(playbook.text).toContain("## Good examples");
      expect(playbook.banned).toEqual(
        expect.arrayContaining(["excelência", "descubra", "venha conhecer"]),
      );
    }
    expect(playbookFor("health").version).toBe("general@1+common@1");
  });

  it("keeps every version label within the schema's 40 characters", () => {
    for (const family of [...playbookFamilies, "pet-agro-institutions" as const]) {
      expect(playbookFor(family).version.length).toBeLessThanOrEqual(40);
    }
  });

  it("never breaks its own banned list in its good examples", () => {
    for (const family of playbookFamilies) {
      const { text, banned } = playbookFor(family);
      const examples = /## Good examples\n([\s\S]*?)\n## /.exec(text)?.[1] ?? "";
      const fields = Object.fromEntries(
        examples
          .split("\n")
          .filter((line) => line.startsWith("- "))
          .map((line, index) => [`example.${index}`, line.replace(/^- [^:]+: /, "")]),
      );
      expect(checkStyle(fields, banned, [], [])).toEqual([]);
    }
  });

  it("refuses a playbook without front matter", () => {
    expect(() => parsePlaybook("# no front matter")).toThrow();
    const file = readFileSync(new URL("../playbooks/common.md", import.meta.url), "utf8");
    expect(parsePlaybook(file).family).toBe("common");
  });
});
