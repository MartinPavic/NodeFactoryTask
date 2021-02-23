import { getDataFromAPI, parseResponse } from "../index";
import { strictEqual } from "assert";

describe("Parse response test", function() {
  it("should be able to parse axios response", async function() {
    const response = await getDataFromAPI();
    const parsedResponse = parseResponse(response);
    strictEqual(response.data.data.pairs.length, parsedResponse.length);
  })
})