import {
  cleanup,
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

describe.skip("TimeTravel [component]", () => {
  beforeEach(() => {
    window.addEventListener("error", onError);
  });
  afterEach(() => {
    window.removeEventListener("error", onError);
  });
  it.skip("renders correctly", () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });

    // defaults
    // date = new Date(2019, 11, 1, 12),
    // startDate = new Date(2019, 11, 1, 12),
    // endDate = new Date(2020, 0, 31, 12),

    const { container } = render(<TimeTravel />);
    const navs = container.getElementsByTagName("nav");
    expect(navs.length).toBe(1);
    expect(navs[0]?.textContent).toContain("December 1, 2019");
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

  it.skip("can use the en-CA locale", async () => {
    const s = new Date(2020, 3, 1);
    const e = new Date(2020, 3, 3);
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    render(<TimeTravel startDate={s} endDate={e} date={s} />);
    expect(screen.getByText("April 1, 2020", { exact: false })).toBeVisible();
  });

  it.skip("can use the fr-CA locale", async () => {
    const s = new Date(2020, 3, 1);
    const e = new Date(2020, 3, 3);
    mockUseParams.mockReturnValue({ locale: "fr-CA" });
    render(<TimeTravel startDate={s} endDate={e} date={s} />);
    expect(screen.getByText("1 avril 2020", { exact: false })).toBeVisible();
  });

  it.skip("displays translated messages", async () => {
    mockUseParams.mockReturnValue({ locale: "en-CA" });
    const chooseDate = "478cb3ih3c8y3gf38gf3";
    const travelText = "dasdasdsad";
    const { container } = render(
      <TimeTravel messages={{ chooseDate, travelText }} />,
    );
    expect(
      within(screen.getByRole("heading", { level: 4 })).getByText(chooseDate, {
        exact: false,
      }),
    ).toBeVisible();
    const active = container.getElementsByTagName("button");
    expect(active[0]?.textContent).toContain(travelText);
  });
});
