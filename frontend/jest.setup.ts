import "@testing-library/jest-dom";

const navActual: object = jest.requireActual("next/navigation");
jest.mock("next/navigation", () => ({
  ...navActual,
  useParams: jest.fn(),
  useRouter() {
    return {
      prefetch: jest.fn(),
      push: jest.fn(),
    }
  },
}));
