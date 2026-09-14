export const getJson = (schema) => schema['~standard'].jsonSchema.output({ target: 'draft-07' });
export const getMeta = (schema) => {
    const js = getJson(schema);
    return { default: js?.default, description: js?.description };
};
export const getDefault = (object, field) => {
    const json = getJson(object);
    if (object.properties[field]?.optional)
        return { value: undefined };
    if (!json.required?.includes(field))
        return { value: undefined };
    if (json.default)
        return { value: json.default };
    const schema = object?.properties?.[field];
    if (!schema)
        return undefined;
    if (schema.default)
        return { value: schema.default };
    const s = object?.properties?.[field];
    if (s) {
        if (s.type === 'undefined')
            return { value: undefined };
        if (s.type === 'union') {
            for (const item of s.oneOf) {
                if (item.type === 'undefined')
                    return { value: undefined };
                const json = getJson(item);
                if (json.default)
                    return { value: json.default };
            }
        }
    }
    if (json.oneOf)
        for (const item of json.oneOf)
            if (item.default)
                return { value: item.default };
    if (json.anyOf)
        for (const item of json.anyOf)
            if (item.default)
                return { value: item.default };
    return undefined;
};
//# sourceMappingURL=schema.js.map