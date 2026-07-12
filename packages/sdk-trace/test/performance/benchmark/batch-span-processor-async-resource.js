/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

const Benchmark = require('benchmark');
const { BatchSpanProcessor, TracerProvider } = require('../../../build/src');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ExportResultCode } = require('@opentelemetry/core');

const BATCH_SIZE = 512;

class NoopExporter {
  export(spans, resultCallback) {
    setTimeout(() => resultCallback({ code: ExportResultCode.SUCCESS }), 0);
  }

  shutdown() {
    return this.forceFlush();
  }

  forceFlush() {
    return Promise.resolve();
  }
}

// Exercises the export path where every span in the batch shares the same
// Resource with pending async attributes. A fresh provider (and therefore a
// fresh pending resource) is created each cycle so the resource-await path is
// actually hit on every iteration.
function flushBatchWithAsyncResource() {
  const resource = resourceFromAttributes({
    'async.attribute': Promise.resolve('resolved-value'),
  });
  const provider = new TracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor({ exporter: new NoopExporter() })],
  });
  const tracer = provider.getTracer('test');

  for (let i = 0; i < BATCH_SIZE; i++) {
    tracer.startSpan('span').end();
  }

  return provider.forceFlush();
}

const suite = new Benchmark.Suite();

suite.on('cycle', event => {
  console.log(String(event.target));
});

suite.add('BatchSpanProcessor forceFlush with shared async resource', {
  defer: true,
  fn: deferred => {
    flushBatchWithAsyncResource().then(() => deferred.resolve());
  },
});

suite.run({ async: false });
