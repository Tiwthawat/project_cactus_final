import request from "supertest";
import { app, pool } from "../../../src/app";

afterAll(() => {
	pool.end();
});

test("get customer with id 1", async () => {
	const response = await request(app)
		.get("/customers/1")
		.expect("Content-Type", /json/)
		.expect(200);

	const data: Array<{ id: number }> = response.body.result;

	// match id field
	expect(data.every(({ id }) => id === 1)).toBe(true);
	// unique
	expect(data.length === 1).toBe(true);
});

test("get customer with id 9999", async () => {
	const response = await request(app)
		.get("/customers/9999")
		.expect("Content-Type", /json/)
		.expect(200);

	const data: Array<{ id: number }> = response.body.result;

	// match id field
	expect(typeof data === "object").toBe(true);
	// unique
	expect(data.length === 0).toBe(true);
});
