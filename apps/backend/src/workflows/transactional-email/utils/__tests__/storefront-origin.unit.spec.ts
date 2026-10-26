import { emailStorefrontOrigin } from "../storefront-origin";

describe("emailStorefrontOrigin", () => {
  it("uses the origin of the first STORE_CORS entry only", () => {
    expect(emailStorefrontOrigin(" https://shop.example.test/path , https://other.example.test")).toBe(
      "https://shop.example.test"
    );
  });

  it.each(["", "invalid", "http://shop.example.test", "https://user:password@shop.example.test", "ftp://shop.example.test"])(
    "refuses the unusable configuration %p",
    (storeCors) => {
      expect(() => emailStorefrontOrigin(storeCors)).toThrow("Email storefront configuration is invalid");
    }
  );

  it.each(["http://localhost:8000", "http://127.0.0.1:8000", "http://[::1]:8000"])(
    "allows the local HTTP storefront %p for development",
    (storeCors) => {
      expect(emailStorefrontOrigin(storeCors)).toBe(storeCors);
    }
  );
});
