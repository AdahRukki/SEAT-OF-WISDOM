#!/bin/bash
set -e
# Pulling code must not change a connected database. Apply reviewed migrations
# separately, after explicit approval for the target environment.
npm ci
