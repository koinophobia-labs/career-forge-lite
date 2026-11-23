import {createDraftHead, createDraftPost} from './handler.mjs';

export const runtime = 'nodejs';
export const HEAD = createDraftHead();
export const POST = createDraftPost();
