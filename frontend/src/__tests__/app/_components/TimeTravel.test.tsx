import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useParams } from "next/navigation";

import TimeTravel from "~/app/_components/TimeTravel";

const mockUseParams = useParams as jest.MockedFunction<typeof useParams>;
const onError = (e: ErrorEvent) => {
  e.preventDefault();
};

describe("TimeTravel [component]", () => {
  beforeEach(() => {
    window.addEventListener("error", onError);
  });
  afterEach(() => {
    window.removeEventListener("error", onError);
  });
  it("renders correctly", () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });

    // defaults
    // date = new Date(2019, 11, 1, 12),
    // startDate = new Date(2019, 11, 1, 12),
    // endDate = new Date(2020, 0, 31, 12),

    const { container } = render(<TimeTravel />);

    const anchors = container.getElementsByTagName("A");
    expect(anchors.length).toBe(66);
    expect(anchors[2]?.textContent).toContain("Dec 1, 2019");
    expect(anchors[anchors.length - 3]?.textContent).toContain("Jan 31, 2020");
  });

  it("doesn't allow invalid dates", () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    const s = new Date(2020, 1, 1);
    const e = new Date(2020, 2, 1);
    const l = new Date(2026, 1, 1);
    const d1 = new Date(2020, 1, 12);
    const d2 = new Date(2019, 11, 31);

    render(<TimeTravel startDate={e} endDate={s} />);
    expect(screen.getByTestId("errorboundary")).toBeVisible();
    cleanup();
    render(<TimeTravel startDate={s} endDate={l} />);
    expect(screen.getByTestId("errorboundary")).toBeVisible();
    cleanup();
    render(<TimeTravel startDate={s} endDate={e} date={d2} />);
    expect(screen.getByTestId("errorboundary")).toBeVisible();
    cleanup();
    render(<TimeTravel startDate={s} endDate={e} date={d1} />);
    expect(() => screen.getByTestId("errorboundary")).toThrow(
      "Unable to find an element",
    );
  });

  it("can use the en-CA locale", async () => {
    const s = new Date(2020, 3, 1);
    const e = new Date(2020, 3, 3);
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    render(<TimeTravel startDate={s} endDate={e} date={s} />);
    expect(await screen.findByText("Apr 1, 2020")).toBeVisible();
  });

  it("can use the fr-CA locale", async () => {
    const s = new Date(2020, 3, 1);
    const e = new Date(2020, 3, 3);
    mockUseParams.mockReturnValue({ locale: "fr-CA" });
    render(<TimeTravel startDate={s} endDate={e} date={s} />);
    expect(await screen.findByText("1 avr. 2020")).toBeVisible();
  });

  it("displays translated messages", async () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    const chooseDate = "478cb3ih3c8y3gf38gf3";
    const currentDate = "321erwdfkjwfjhn3";
    const travelText = "dasdasdsad";
    const { container } = render(
      <TimeTravel messages={{ chooseDate, currentDate, travelText }} />,
    );
    expect(
      await within(screen.getByRole("heading", { level: 4 })).findByText(
        chooseDate,
      ),
    ).toBeVisible();
    const active = container.getElementsByClassName("active");
    expect(active[0]?.textContent).toContain(currentDate);
    expect(active[0]?.textContent).toContain(travelText);
  });

  it("adds the active class to the specified date", async () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    const s = new Date(2020, 1, 1);
    const e = new Date(2020, 2, 1);
    const d = new Date(2020, 1, 5);

    const { container } = render(
      <TimeTravel startDate={s} endDate={e} date={d} />,
    );
    const active = container.getElementsByClassName("active");
    expect(active.length).toEqual(1);
    expect(active[0]?.tagName).toEqual("LI");
    expect(active[0]?.textContent).toContain("Feb 5, 2020");
  });

  it("can trigger the onChange handler", async () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    const onChange = jest.fn();
    const s = new Date(2020, 1, 1);
    const e = new Date(2020, 2, 1);
    const d = new Date(2020, 1, 5);

    const { container } = render(
      <TimeTravel startDate={s} endDate={e} date={d} onChange={onChange} />,
    );
    const active = container.getElementsByTagName("A");
    expect(active.length).toBeGreaterThan(1);
    const elem = active[2];
    expect(elem?.textContent).toContain("Feb 1, 2020");
    elem && fireEvent.click(elem);
    expect(onChange).toHaveBeenCalledWith(s, expect.anything());
  });

  it("can go to start using start button", async () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    const onChange = jest.fn();
    const s = new Date(2020, 1, 1);
    const e = new Date(2020, 2, 1);
    const d = new Date(2020, 1, 5);

    const { container } = render(
      <TimeTravel startDate={s} endDate={e} date={d} onChange={onChange} />,
    );
    const active = container.getElementsByTagName("A");
    expect(active.length).toBeGreaterThan(1);
    const elem = active[0];
    expect(elem?.textContent).toContain("Start");
    elem && fireEvent.click(elem);
    expect(onChange).toHaveBeenCalledWith(s, expect.anything());
  });
  it("can go to previous day using prev button", async () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    const onChange = jest.fn();
    const s = new Date(2020, 1, 1);
    const e = new Date(2020, 2, 1);
    const d = new Date(2020, 1, 5);

    const { container } = render(
      <TimeTravel startDate={s} endDate={e} date={d} onChange={onChange} />,
    );
    const active = container.getElementsByTagName("A");
    expect(active.length).toBeGreaterThan(1);
    const elem = active[1];
    expect(elem?.textContent).toContain("Prev");
    elem && fireEvent.click(elem);
    expect(onChange).toHaveBeenCalledWith(
      new Date(d.setDate(d.getDate() - 1)),
      expect.anything(),
    );
  });

  it("start and prev buttons are disabled when start date is active", async () => {
    const s = new Date(2020, 1, 1);
    const e = new Date(2020, 2, 1);

    const { container } = render(
      <TimeTravel startDate={s} endDate={e} date={s} />,
    );
    const active = container.getElementsByTagName("A");
    expect(active.length).toBeGreaterThan(4);
    const elem1 = active[0];
    const elem2 = active[1];
    expect(elem1?.getAttribute("aria-disabled")).toBe("true");
    expect(elem2?.getAttribute("aria-disabled")).toBe("true");
  });

  it("next and last buttons are disabled when end date is active", async () => {
    const s = new Date(2020, 1, 1);
    const e = new Date(2020, 2, 1);

    const { container } = render(
      <TimeTravel startDate={s} endDate={e} date={e} />,
    );
    const active = container.getElementsByTagName("A");
    expect(active.length).toBeGreaterThan(4);
    const elem1 = active[active.length - 1];
    const elem2 = active[active.length - 2];
    expect(elem1?.getAttribute("aria-disabled")).toBe("true");
    expect(elem2?.getAttribute("aria-disabled")).toBe("true");
  });

  it("can go to last using end button", async () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    const onChange = jest.fn();
    const s = new Date(2020, 1, 1);
    const e = new Date(2020, 2, 1);
    const d = new Date(2020, 1, 5);

    const { container } = render(
      <TimeTravel startDate={s} endDate={e} date={d} onChange={onChange} />,
    );
    const active = container.getElementsByTagName("A");
    expect(active.length).toBeGreaterThan(1);
    const elem = active[active.length - 1];
    expect(elem?.textContent).toContain("End");
    elem && fireEvent.click(elem);
    expect(onChange).toHaveBeenCalledWith(e, expect.anything());
  });
  it("can go to next day using next button", async () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    const onChange = jest.fn();
    const s = new Date(2020, 1, 1);
    const e = new Date(2020, 2, 1);
    const d = new Date(2020, 1, 5);

    const { container } = render(
      <TimeTravel startDate={s} endDate={e} date={d} onChange={onChange} />,
    );
    const active = container.getElementsByTagName("A");
    expect(active.length).toBeGreaterThan(1);
    const elem = active[active.length - 2];
    expect(elem?.textContent).toContain("Next");
    elem && fireEvent.click(elem);
    expect(onChange).toHaveBeenCalledWith(
      new Date(d.setDate(d.getDate() + 1)),
      expect.anything(),
    );
  });
});
