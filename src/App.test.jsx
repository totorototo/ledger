import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App, { connectHint } from "./App.jsx";
import useStore from "./store/store.js";
import { activity, profile } from "./test/fixtures.js";
import ThemedApp from "./ThemedApp.jsx";

const initial = useStore.getState();
const readyState = { status: "ready", profile };

describe("App", () => {
  // connect is stubbed: no test reaches the proxy.
  beforeEach(() => useStore.setState({ ...initial, connect: vi.fn() }, true));

  it("connects as it opens", () => {
    render(<ThemedApp />);
    expect(useStore.getState().connect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ledger");
    expect(screen.getByRole("status")).toHaveTextContent(/Reading your Garmin account/);
  });

  it("says where the key goes when the server has none", async () => {
    useStore.setState({ status: "error", error: "No key.", errorStatus: 503 });
    render(<ThemedApp />);
    expect(screen.getByRole("alert")).toHaveTextContent(/GARMIN_PERSONAL_API_KEY/);
    expect(screen.getByText("The server said: No key.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(useStore.getState().connect).toHaveBeenCalled();
  });

  it("offers only the Year and All-time views once connected", () => {
    useStore.setState({ ...readyState, loadYear: vi.fn() });
    render(<ThemedApp />);
    expect(screen.getByText("runner")).toBeInTheDocument();
    const views = screen.getByRole("navigation", { name: "Views" });
    expect(views.querySelectorAll("button")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Activities" })).toBeNull();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      String(new Date().getFullYear()),
    );
  });
});

describe("Year", () => {
  const year = [
    activity({ startTimeLocal: "2025-03-02 08:00:00" }),
    activity({ activityId: 2, startTimeLocal: "2025-03-20 08:00:00", distance: 8000 }),
    activity({
      activityId: 3,
      startTimeLocal: "2025-08-01 18:00:00",
      activityType: { typeKey: "cycling" },
      distance: 60_000,
      duration: 7200,
      elevationGain: 600,
    }),
  ];

  beforeEach(() =>
    useStore.setState(
      { ...initial, ...readyState, connect: vi.fn(), loadYear: vi.fn(), year: 2025 },
      true,
    ),
  );

  it("switches to the year from the toolbar, and asks for the year it shows", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Year" }));
    expect(useStore.getState().view).toBe("year");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2025");
    expect(screen.getByText(/Reading 2025/).closest("[role=status]")).not.toBeNull();
    expect(useStore.getState().loadYear).toHaveBeenCalledWith(2025);
  });

  it("sums the year, plots its months and ranks its sports", async () => {
    useStore.setState({
      view: "year",
      years: { 2025: { status: "ready", activities: year, error: null } },
    });
    render(<App />);
    expect(screen.getByText("Activities", { selector: "dt" }).nextSibling).toHaveTextContent("3");
    expect(screen.getByText("89 km")).toBeInTheDocument();
    // The best month by distance, until the pointer or focus picks another.
    const readout = () => document.querySelector(".readout");
    expect(readout()).toHaveTextContent("Best month60.0 kmAug · 1 activity");
    act(() => screen.getByRole("img", { name: "Mar: 29.1 km" }).focus());
    expect(readout()).toHaveTextContent("Month29.1 kmMar · 2 activities");
    const measures = screen.getByRole("group", { name: "Measure" });
    await userEvent.click(within(measures).getByRole("button", { name: "Time" }));
    expect(screen.getByRole("img", { name: "Mar: 5h00" })).toBeInTheDocument();
    const sports = screen.getByRole("table", { name: "By sport" });
    expect(sports.querySelectorAll("tbody th")[0]).toHaveTextContent("Trail running");
    expect(screen.getByRole("table", { name: "Months" })).toHaveTextContent("Aug160.0 km2h00600 m");
  });

  it("runs the year's total against the year before's at the same date", async () => {
    const before = [
      activity({ activityId: 9, startTimeLocal: "2024-03-10 08:00:00", distance: 44_550 }),
    ];
    useStore.setState({
      view: "year",
      years: {
        2024: { status: "ready", activities: before, error: null },
        2025: { status: "ready", activities: year, error: null },
      },
    });
    render(<App />);
    const running = document.querySelector(".running .readout");
    expect(running).toHaveTextContent("2025 total89.1 km+100% vs 2024 at that date (44.5 km)");
    // The tiles, against the whole year before (2025 is past).
    const tiles = document.querySelector(".totals");
    expect(tiles).toHaveTextContent("+200% vs 2024");
    // One measure switch for the page: both charts follow it.
    const measures = screen.getAllByRole("group", { name: "Measure" });
    expect(measures).toHaveLength(1);
    await userEvent.click(within(measures[0]).getByRole("button", { name: "Time" }));
    expect(screen.getByText("Time per month")).toBeInTheDocument();
    expect(screen.getByText("Time through the year")).toBeInTheDocument();
    expect(useStore.getState().measure).toBe("duration");
    await userEvent.click(within(measures[0]).getByRole("button", { name: "Distance" }));
    act(() => document.querySelector(".lines").focus());
    act(() => {
      document
        .querySelector(".lines")
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    expect(running).toHaveTextContent("2025 by Jan 1");
  });

  it("shows the year's training once it carries load or heart rate", () => {
    const bare = year.map((a) => ({ ...a, averageHR: undefined }));
    useStore.setState({
      view: "year",
      years: { 2025: { status: "ready", activities: bare, error: null } },
    });
    const { unmount } = render(<App />);
    expect(screen.queryByRole("heading", { name: "Training" })).toBeNull();
    unmount();
    const withHR = year.map((a) => ({
      ...a,
      averageSpeed: 3,
      activityTrainingLoad: 80,
      hrTimeInZone_2: 3000,
    }));
    useStore.setState({ years: { 2025: { status: "ready", activities: withHR, error: null } } });
    render(<App />);
    expect(screen.getByRole("heading", { name: "Training" })).toBeInTheDocument();
    expect(
      screen.getByText(/Load on 3 of 3 activities; heart rate on 2 of 2 runs/),
    ).toBeInTheDocument();
    // A column per month of the year, Jan to Dec.
    const intensity = screen.getByRole("group", { name: "Intensity per month" });
    expect(within(intensity).getAllByRole("img")).toHaveLength(12);
  });

  it("asks for the year before too, for the comparison", () => {
    useStore.setState({
      view: "year",
      years: { 2025: { status: "ready", activities: year, error: null } },
    });
    render(<App />);
    expect(useStore.getState().loadYear).toHaveBeenCalledWith(2024);
  });

  it("sums only the activity types picked", async () => {
    useStore.setState({
      view: "year",
      years: { 2025: { status: "ready", activities: year, error: null } },
    });
    render(<App />);
    const legend = screen.getByRole("group", { name: "Activity type" });
    const count = () => screen.getByText("Activities", { selector: "dt" }).nextSibling;
    // The stacks: March is two runs, August one ride.
    expect(document.querySelectorAll(".segment")).toHaveLength(2);
    await userEvent.click(within(legend).getByRole("button", { name: "Cycling" }));
    expect(useStore.getState().types).toEqual(["cycling"]);
    expect(count()).toHaveTextContent("1");
    expect(document.querySelector(".totals")).toHaveTextContent("60 km");
    await userEvent.click(within(legend).getByRole("button", { name: "Trail running" }));
    expect(count()).toHaveTextContent("3");
    await userEvent.click(within(legend).getByRole("button", { name: "All" }));
    expect(useStore.getState().types).toEqual([]);
    expect(within(legend).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps the legend when the picked types have nothing this year", () => {
    useStore.setState({
      view: "year",
      types: ["hiking"],
      years: { 2025: { status: "ready", activities: year, error: null } },
    });
    render(<App />);
    expect(screen.getByText("None of these types in 2025.")).toBeInTheDocument();
    const legend = screen.getByRole("group", { name: "Activity type" });
    expect(within(legend).getByRole("button", { name: "All" })).toBeEnabled();
  });

  it("makes each chart one tab stop, the arrows moving inside it", async () => {
    useStore.setState({
      view: "year",
      years: { 2025: { status: "ready", activities: year, error: null } },
    });
    render(<App />);
    const months = within(screen.getByRole("group", { name: "Distance per month" }));
    const columns = months.getAllByRole("img");
    // The best month (Aug) is the chart's one tab stop.
    expect(columns.filter((c) => c.tabIndex === 0)).toHaveLength(1);
    expect(months.getByRole("img", { name: "Aug: 60.0 km" })).toHaveAttribute("tabindex", "0");
    act(() => months.getByRole("img", { name: "Aug: 60.0 km" }).focus());
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toHaveAccessibleName("Jul: 0.0 km");
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toHaveAccessibleName(/^Jan: /);
  });

  it("tells this year's months to come from months of nothing", () => {
    const now = new Date();
    const thisYear = now.getFullYear();
    useStore.setState({
      view: "year",
      year: thisYear,
      years: {
        [thisYear]: {
          status: "ready",
          activities: [activity({ startTimeLocal: `${thisYear}-01-10 08:00:00` })],
          error: null,
        },
      },
    });
    render(<App />);
    expect(screen.getByText("Year to date")).toBeInTheDocument();
    const future = document.querySelectorAll(".column.is-future");
    expect(future).toHaveLength(11 - now.getMonth());
    if (now.getMonth() < 11) {
      expect(screen.getByRole("img", { name: "Dec: still to come" })).toBeInTheDocument();
    }
  });

  it("jumps to a year from the picker", async () => {
    useStore.setState({
      view: "year",
      years: { 2025: { status: "ready", activities: year, error: null } },
    });
    render(<App />);
    const picker = screen.getByRole("combobox", { name: "Year" });
    expect(picker).toHaveValue("2025");
    await userEvent.selectOptions(picker, "2023");
    expect(useStore.getState().year).toBe(2023);
  });

  it("says when a year is empty, and stops at this year", () => {
    const thisYear = new Date().getFullYear();
    useStore.setState({
      view: "year",
      year: thisYear,
      years: { [thisYear]: { status: "ready", activities: [], error: null } },
    });
    render(<App />);
    expect(screen.getByText(`No activities in ${thisYear}.`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next year" })).toBeDisabled();
  });
});

describe("All time", () => {
  const history = [
    activity({ activityId: 3, startTimeLocal: "2025-08-01 18:00:00" }),
    activity({ activityId: 2, startTimeLocal: "2025-03-01 08:00:00", distance: 8000 }),
    activity({ activityId: 1, startTimeLocal: "2023-05-01 08:00:00" }),
  ];

  beforeEach(() =>
    useStore.setState(
      { ...initial, ...readyState, connect: vi.fn(), loadHistory: vi.fn(), view: "all" },
      true,
    ),
  );

  it("reads the history as it opens, counting as it goes", () => {
    useStore.setState({ history: { status: "loading", count: 300, activities: [] } });
    render(<App />);
    expect(screen.getByText(/300 activities so far/).closest("[role=status]")).not.toBeNull();
  });

  it("asks for the history when it has none", () => {
    render(<App />);
    expect(useStore.getState().loadHistory).toHaveBeenCalled();
  });

  it("keeps the training to the year page", () => {
    useStore.setState({ history: { status: "ready", activities: history, firstYear: 2023 } });
    render(<App />);
    expect(screen.queryByRole("heading", { name: "Training" })).toBeNull();
  });

  it("sums every year, keeps the empty ones, and opens a year from its row", async () => {
    const thisYear = new Date().getFullYear();
    useStore.setState({
      history: { status: "ready", count: 3, activities: history, firstYear: 2023, error: null },
      loadYear: vi.fn(),
    });
    render(<App />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(`2023–${thisYear}`);
    expect(screen.getByRole("img", { name: "2024: 0.0 km" })).toBeInTheDocument();
    const years = screen.getByRole("table", { name: "Years" });
    expect(years.querySelector("tbody tr")).toHaveTextContent(String(thisYear));
    await userEvent.click(screen.getByRole("button", { name: "2025" }));
    expect(useStore.getState()).toMatchObject({ view: "year", year: 2025 });
  });
});

describe("connectHint", () => {
  it("tells a missing key from a refused one", () => {
    expect(connectHint(503)).toMatchObject({ title: "No API key yet", hint: /\.env/ });
    expect(connectHint(401).title).toBe("Garmin refused the key");
    expect(connectHint(null)).toMatchObject({
      title: "Garmin did not answer",
      hint: /could not be reached/,
    });
  });
});

describe("Toolbar", () => {
  beforeEach(() =>
    useStore.setState(
      { ...initial, ...readyState, connect: vi.fn(), refresh: vi.fn(), loadYear: vi.fn() },
      true,
    ),
  );
  const sync = () => screen.getByText((_, el) => el?.classList.contains("sync"));

  it("says nothing once the history is up to date", () => {
    useStore.setState({ history: { status: "ready", activities: [], synced: true, error: null } });
    render(<ThemedApp />);
    expect(sync()).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute("aria-busy", "false");
  });

  it("says it is updating while what's new is read", () => {
    useStore.setState({ history: { status: "ready", activities: [], syncing: true } });
    render(<ThemedApp />);
    expect(sync()).toHaveTextContent("Updating…");
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute("aria-busy", "true");
  });

  it("says the data shown is the saved one when the update failed", () => {
    useStore.setState({
      history: { status: "ready", activities: [], synced: true, error: "Garmin answered 500." },
    });
    render(<ThemedApp />);
    expect(sync()).toHaveTextContent("Couldn’t update · showing saved data");
    expect(screen.getByTitle("Garmin answered 500.")).toBeInTheDocument();
  });

  it("reads everything again on Refresh", async () => {
    render(<ThemedApp />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(useStore.getState().refresh).toHaveBeenCalledOnce();
  });
});
