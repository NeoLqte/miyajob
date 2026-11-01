import '@testing-library/jest-dom/vitest';
import {afterEach,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
HTMLDialogElement.prototype.showModal=vi.fn(function(this:HTMLDialogElement){this.open=true;});
HTMLDialogElement.prototype.close=vi.fn(function(this:HTMLDialogElement){this.open=false;});
