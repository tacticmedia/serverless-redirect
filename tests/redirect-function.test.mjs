import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadTemplate, substitute } from './support/cloudformation.mjs';

const template = loadTemplate(new URL('../template.yaml', import.meta.url));

function loadHandler(redirectType = 'permanent') {
    const functionCode = template.Resources.RedirectFunction.Properties.FunctionCode['Fn::Sub'];
    const code = substitute(template, functionCode, { NewDomainName: 'new.example.com', RedirectType: redirectType });

    return vm.runInNewContext(`${code}\nhandler;`);
}

function redirect(handler, uri, rawQueryString, forwardedProto = 'https') {
    const headers = forwardedProto === null ? {} : { 'cloudfront-forwarded-proto': { value: forwardedProto } };

    return handler({ request: { uri, headers, rawQueryString: () => rawQueryString } });
}

const expectedStatusByRedirectType = {
    permanent: [308, 'Permanent Redirect'],
    temporary: [307, 'Temporary Redirect'],
};

test('Returns status code and description for every RedirectType', () => {
    assert.deepEqual(Object.keys(expectedStatusByRedirectType), template.Parameters.RedirectType.AllowedValues);
    for (const [redirectType, [statusCode, statusDescription]] of Object.entries(expectedStatusByRedirectType)) {
        const response = redirect(loadHandler(redirectType), '/', undefined);
        assert.equal(response.statusCode, statusCode);
        assert.equal(response.statusDescription, statusDescription);
    }
});

test('Keeps path and omits ? when request has no query string', () => {
    const response = redirect(loadHandler(), '/a/b%20c/', undefined);
    assert.equal(response.headers.location.value, 'https://new.example.com/a/b%20c/');
});

test('Keeps a bare ?', () => {
    const response = redirect(loadHandler(), '/a', '');
    assert.equal(response.headers.location.value, 'https://new.example.com/a?');
});

test('Keeps raw query string byte for byte', () => {
    const response = redirect(loadHandler(), '/a', 'b=2&a=1&flag&a=%20x+y');
    assert.equal(response.headers.location.value, 'https://new.example.com/a?b=2&a=1&flag&a=%20x+y');
});

test('Keeps the viewer scheme', () => {
    assert.equal(redirect(loadHandler(), '/a', undefined, 'https').headers.location.value, 'https://new.example.com/a');
    assert.equal(redirect(loadHandler(), '/a', undefined, 'http').headers.location.value, 'http://new.example.com/a');
    assert.equal(redirect(loadHandler(), '/a', undefined, 'HTTPS').headers.location.value, 'https://new.example.com/a');
});

test('Falls back to http when CloudFront-Forwarded-Proto is absent', () => {
    assert.equal(redirect(loadHandler(), '/a', undefined, null).headers.location.value, 'http://new.example.com/a');
});
