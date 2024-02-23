import { fireEvent, render, screen, within } from "@testing-library/react";
import { useParams } from "next/navigation";

import TimeTravel from "~/app/_components/TimeTravel";

const mockUseParams = useParams as jest.MockedFunction<typeof useParams>;

describe("TimeTravel [component]", () => {
  it("renders", () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    render(<TimeTravel />);
  });

  it("doesn't allow invalid dates", () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    const s = new Date(2020, 1, 1);
    const e = new Date(2020, 2, 1);
    const l = new Date(2026, 1, 1);
    const d1 = new Date(2020, 1, 12);
    const d2 = new Date(2019, 11, 31);

    expect(() => render(<TimeTravel startDate={e} endDate={s} />)).toThrow();
    expect(() => render(<TimeTravel startDate={s} endDate={l} />)).toThrow();
    expect(() =>
      render(<TimeTravel startDate={s} endDate={e} date={d2} />),
    ).toThrow();
    expect(() =>
      render(<TimeTravel startDate={s} endDate={e} date={d1} />),
    ).not.toThrow();
  });

  it("can use the en-CA locale", async () => {
    const s = new Date(2020, 3, 1);
    const e = new Date(2020, 3, 3);
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    render(<TimeTravel startDate={s} endDate={e} date={s} />);
    expect(await screen.findByText("Apr 1, 20")).toBeVisible();
  });

  it("can use the fr-CA locale", async () => {
    const s = new Date(2020, 3, 1);
    const e = new Date(2020, 3, 3);
    mockUseParams.mockReturnValue({ locale: "fr-CA" });
    render(<TimeTravel startDate={s} endDate={e} date={s} />);
    expect(await screen.findByText("1 avr. 20")).toBeVisible();
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
    expect(active[0]?.textContent).toContain("Feb 5, 20");
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
    expect(active[0]?.textContent).toContain("Feb 1, 20");
    const elem = active[0];
    elem && fireEvent.click(elem);
    expect(onChange).toHaveBeenCalledWith(s);
  });
});
