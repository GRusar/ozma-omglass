#!/bin/sh -e
# Build and publish the application.

set -x

test -f yarn.lock
rm -rf dist-evaluation
yarn
CONFIG=evaluation OUTDIR=dist-evaluation yarn build