import test from "node:test";

test.skip("placeOrder rejects when client unit_price diverges; requires live Postgres on DATABASE_URL");
test.skip("placeOrder rejects when a required option is missing; requires live Postgres on DATABASE_URL");
test.skip("placeOrder rejects when multi_select exceeds max_selections; requires live Postgres on DATABASE_URL");
test.skip("placeOrder rejects when an option value belongs to another business; requires live Postgres on DATABASE_URL");
test.skip("placeOrder accepts configured order and writes options_json; requires live Postgres on DATABASE_URL");
test.skip("transitionOrderStatus rejects when caller does not own the order business; requires live Postgres on DATABASE_URL");
test.skip("getOrdersByBusinessId scopes order list to the caller business; requires live Postgres on DATABASE_URL");
