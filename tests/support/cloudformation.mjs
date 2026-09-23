import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const intrinsicFunctions = ['Base64', 'Cidr', 'FindInMap', 'GetAtt', 'GetAZs', 'ImportValue', 'Join', 'Select', 'Split', 'Sub', 'Transform', 'And', 'Equals', 'If', 'Not', 'Or'];

const shortFormTags = [
    ...intrinsicFunctions.map((name) => [`!${name}`, `Fn::${name}`]),
    ['!Ref', 'Ref'],
    ['!Condition', 'Condition'],
].flatMap(([tag, key]) => [
    { tag, resolve: (value) => ({ [key]: value }) },
    { tag, collection: 'seq', resolve: (value) => ({ [key]: value.toJSON() }) },
    { tag, collection: 'map', resolve: (value) => ({ [key]: value.toJSON() }) },
]);

export function loadTemplate(url) {
    return parse(readFileSync(url, 'utf8'), { customTags: shortFormTags });
}

/** Supports Ref to a parameter and Fn::FindInMap only. */
export function evaluate(template, node, parameters) {
    if (typeof node === 'string' || typeof node === 'number') {
        return node;
    }
    if ('Ref' in node) {
        if (!(node.Ref in parameters)) {
            throw new Error(`No value for parameter ${node.Ref}`);
        }

        return parameters[node.Ref];
    }
    if ('Fn::FindInMap' in node) {
        const [mapName, topKey, secondKey] = node['Fn::FindInMap'].map((part) => evaluate(template, part, parameters));

        return template.Mappings[mapName][topKey][secondKey];
    }
    throw new Error(`Unsupported intrinsic function ${Object.keys(node)[0]}`);
}

export function substitute(template, sub, parameters) {
    const [text, variables = {}] = Array.isArray(sub) ? sub : [sub];

    return text.replace(/\$\{([\w:]+)\}/g, (_, name) =>
        String(name in variables ? evaluate(template, variables[name], parameters) : evaluate(template, { Ref: name }, parameters)),
    );
}
