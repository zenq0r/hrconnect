import assert from "node:assert/strict";
import test from "node:test";
import { computeXSignature, verifyXSignature } from "../lib/signature";

const key = "S-s7b4yWpp9h7rrkNM1i3Z_g";

test("Billplz official redirect X Signature vector", () => {
  const data = {
    "billplz[id]": "zq0tm2wc",
    "billplz[paid]": "true",
    "billplz[paid_at]": "2018-09-27 15:15:09 +0800",
  };

  const expected = "4aab095fe5a39b1d534500988f9a0cb085cd1b6d5bbb55dd4e02ea6fa102b47b";
  assert.equal(computeXSignature(data, key), expected);
  assert.equal(
    verifyXSignature({ ...data, "billplz[x_signature]": expected }, key),
    true,
  );
});

test("tampered redirect is rejected", () => {
  const signature = "4aab095fe5a39b1d534500988f9a0cb085cd1b6d5bbb55dd4e02ea6fa102b47b";
  assert.equal(
    verifyXSignature(
      {
        "billplz[id]": "zq0tm2wc",
        "billplz[paid]": "false",
        "billplz[paid_at]": "2018-09-27 15:15:09 +0800",
        "billplz[x_signature]": signature,
      },
      key,
    ),
    false,
  );
});
