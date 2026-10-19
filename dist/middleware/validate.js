"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
/**
 * Validates and replaces req.body / req.params / req.query with the parsed (typed, trimmed) values.
 * A ZodError is thrown on failure and formatted by the global error handler (HTTP 422).
 */
const validate = (schemas) => (req, _res, next) => {
    if (schemas.body)
        req.body = schemas.body.parse(req.body);
    if (schemas.params)
        req.params = schemas.params.parse(req.params);
    if (schemas.query) {
        // Express 5: req.query is a getter, so define the parsed value on the request instead
        Object.defineProperty(req, "query", {
            value: schemas.query.parse(req.query),
            writable: true,
            configurable: true,
            enumerable: true,
        });
    }
    next();
};
exports.validate = validate;
//# sourceMappingURL=validate.js.map