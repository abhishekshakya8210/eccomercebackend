import test from "node:test";
import assert from "node:assert/strict";
import { register, login } from "../controllers/userregistercontroller.js";

test("User Register & Login Controller Validations", async (t) => {
    await t.test("register: should return 400 if name, email, or password missing", async () => {
        let statusCode = null;
        let responseJson = null;

        const req = {
            body: { email: "test@example.com" } // missing name and password
        };
        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => { responseJson = data; }
                };
            }
        };

        await register(req, res);
        assert.equal(statusCode, 400);
        assert.equal(responseJson.status, false);
        assert.equal(responseJson.message, "first fill all the fields");
    });

    await t.test("login: should return 400 if email or password missing", async () => {
        let statusCode = null;
        let responseJson = null;

        const req = {
            body: { email: "test@example.com" } // missing password
        };
        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => { responseJson = data; }
                };
            }
        };

        await login(req, res);
        assert.equal(statusCode, 400);
        assert.equal(responseJson.status, false);
        assert.equal(responseJson.message, "first fill all the fields");
    });
});

