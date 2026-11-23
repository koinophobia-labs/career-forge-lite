import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftHead, createDraftPost} from './handler.mjs';

const sku = 'com.koinophobialabs.wayin.resume_toolkit';
const env = {
  WAYIN_DRAFT_PROVIDER: 'openai',
  WAYIN_DRAFT_API_KEY: 'fake',
  WAYIN_DRAFT_MODEL: 'fake',
  WAYIN_PLAY_SERVICE_ACCOUNT_JSON: '{"client_email":"fake","private_key":"fake"}',
};
function request(token = 'example') {
  return new Request('https://example.test/api/android-draft', {
    method: 'POST', body: JSON.stringify({text: 'Approved excerpt', sku, token}),
  });
}

test('HEAD signals readiness without a purchase token, draft text or response body', () => {
  const response = createDraftHead({env})();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('x-wayin-draft'), 'ready');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.body, null);
});

test('HEAD fails closed for each missing setting or malformed account', () => {
  for (const overrides of [
    ...Object.keys(env).map(key => ({[key]: ''})),
    {WAYIN_DRAFT_PROVIDER: 'unsupported'},
    {WAYIN_PLAY_SERVICE_ACCOUNT_JSON: '{'},
    {WAYIN_PLAY_SERVICE_ACCOUNT_JSON: '{"client_email":"fake"}'},
  ]) {
    const response = createDraftHead({env: {...env, ...overrides}})();
    assert.equal(response.status, 503);
    assert.equal(response.headers.has('x-wayin-draft'), false);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.body, null);
  }
});
test('missing configuration does not verify or draft', async () => {
  const shouldNotRun = () => assert.fail('Upstream called');
  const response = await createDraftPost({
    env: {...env, WAYIN_DRAFT_API_KEY: ''},
    verifyPurchase: shouldNotRun, draft: shouldNotRun,
  })(request());
  assert.equal(response.status, 503);
});
test('missing or unverified purchase cannot draft', async () => {
  let drafted = false;
  const post = createDraftPost({env, verifyPurchase: async () => false,
    draft: async () => { drafted = true; }});
  assert.equal((await post(request(''))).status, 400);
  assert.equal((await post(request())).status, 403);
  assert.equal(drafted, false);
});
test('only explicit text reaches the provider after verification', async () => {
  const paragraphs = [{text: 'I helped customers.', sourceIndices: [0]}];
  const post = createDraftPost({env,
    verifyPurchase: async (_fetch, _account, product, token) => {
      assert.equal(product, sku);
      assert.equal(token, 'example');
      return true;
    },
    draft: async (_fetch, _env, text) => {
      assert.equal(text, 'Approved excerpt');
      return paragraphs;
    },
  });
  const response = await post(request());
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {paragraphs});
});

test('expired, pending, refunded and consumed purchases do not use the provider', async () => {
  const {generateKeyPairSync} = await import('node:crypto');
  const {privateKey} = generateKeyPairSync('rsa', {
    modulusLength: 2048, privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
    publicKeyEncoding: {type: 'spki', format: 'pem'},
  });
  const now = Date.UTC(2026, 10, 18);
  const valid = {
    purchaseTimeMillis: String(now - 1000), purchaseState: 0,
    acknowledgementState: 1, consumptionState: 0,
  };
  const pass = 'com.koinophobialabs.wayin.career_pass_30';
  const cases = [
    [pass, {...valid, purchaseTimeMillis: String(now - 30 * 86400000)}, 403],
    [pass, {...valid, purchaseTimeMillis: String(now - 30 * 86400000 + 1)}, 200],
    [sku, {...valid, purchaseState: 1}, 403],
    [sku, {...valid, purchaseState: 2}, 403],
    [sku, {...valid, consumptionState: 1}, 403],
    [sku, {...valid, acknowledgementState: 0}, 403],
    [sku, valid, 200],
  ];
  for (const [product, purchase, expected] of cases) {
    let drafts = 0;
    const post = createDraftPost({
      env: {...env, WAYIN_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: 'fake@example.test', private_key: privateKey,
      })},
      now: () => now,
      fetcher: async (url, {headers, body}) => {
        if (url.startsWith('https://oauth2.googleapis.com/')) {
          assert.equal(body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
          return Response.json({access_token: 'fake access'});
        }
        assert.equal(url, 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' +
          'com.koinophobialabs.wayin/purchases/products/' + product + '/tokens/example');
        assert.equal(headers.authorization, 'Bearer fake access');
        return Response.json(purchase);
      },
      draft: async () => {
        drafts++;
        return [{text: 'Draft', sourceIndices: [0]}];
      },
    });
    const response = await post(new Request('https://example.test/api/android-draft', {
      method: 'POST', body: JSON.stringify({text: 'Approved excerpt', sku: product, token: 'example'}),
    }));
    assert.equal(response.status, expected);
    assert.equal(drafts, expected === 200 ? 1 : 0);
  }
});

test('a failed evidence review prevents a provider draft from being returned', async () => {
  let calls = 0;
  const post = createDraftPost({env,
    verifyPurchase: async () => true,
    fetcher: async (url, {body}) => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      const payload = JSON.parse(body);
      assert.equal(payload.store, false);
      assert.equal(body.includes('example'), false);
      const content = calls++ === 0 ?
        {paragraphs: [{text: 'I invented a claim.', sourceIndices: [0]}]} :
        {supported: false};
      return Response.json({choices: [{message: {content: JSON.stringify(content)}}]});
    },
  });
  assert.equal((await post(request())).status, 503);
  assert.equal(calls, 2);
});

test('allows opaque Play tokens to reach verification unchanged', async () => {
  const token = 'opaque+/=token:1';
  const post = createDraftPost({env,
    verifyPurchase: async (_fetch, _account, _sku, value) => {
      assert.equal(value, token);
      return true;
    },
    draft: async () => [{text: 'Draft', sourceIndices: [0]}],
  });
  assert.equal((await post(request(token))).status, 200);
});
