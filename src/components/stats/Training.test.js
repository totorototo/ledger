import { describe, expect, it } from "vitest";

import { ratioWord } from "./Training.jsx";

describe("ratioWord", () => {
  it("says the load ratio in a word", () => {
    expect(ratioWord(0.6)).toBe("easing off");
    expect(ratioWord(1)).toBe("steady");
    expect(ratioWord(1.3)).toBe("steady");
    expect(ratioWord(1.4)).toBe("building");
    expect(ratioWord(1.8)).toBe("a spike");
  });
});
