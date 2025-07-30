#!/bin/bash

# Deploy Worker from the backend directory (not worker)
cd $(dirname "$0")
wrangler deploy 