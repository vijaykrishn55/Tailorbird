// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { _readPageForTest as readPage } from './capture';

describe('page capture', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.title = 'Backend Engineer';
  });
  it('reads the main content and skips navigation, scripts and hidden text', () => {
    document.body.innerHTML = `<nav>Home Jobs</nav><main><h1>Backend Engineer</h1><p>Build APIs with FastAPI and Redis for our platform team.</p><div hidden>secret hidden text</div><script>alert(1)</script></main><footer>Footer</footer>`;
    const r = readPage();
    expect(r.title).toBe('Backend Engineer');
    expect(r.text).toContain('FastAPI and Redis');
    expect(r.text).not.toContain('Home Jobs');
    expect(r.text).not.toContain('secret hidden');
    expect(r.text).not.toContain('alert');
  });
});
