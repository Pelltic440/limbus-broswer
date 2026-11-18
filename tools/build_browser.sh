#!/bin/bash
# Assembles the browser app: the hub (start page) is copied in from hub/, plus the personal seed data.
set -e
R=/home/claude/limbus; A=$R/browser/app
rm -rf $A/hub && mkdir -p $A/hub/js $A/hub/data
cp $R/hub/index.html $R/hub/app.css $A/hub/
cp $R/hub/js/*.js $A/hub/js/
cp $R/hub/data/catalog.js $R/hub/data/tiersrc.js $R/hub/data/feed.js $A/hub/data/
# The personal seed (your roster/tracker copy) goes only into the private install zip. NO_SEED=1 builds the public update.
if [ -z "$NO_SEED" ]; then
  cp $R/browser/seed.js $A/hub/data/seed.js
  sed -i 's#<script src="data/feed.js"></script>#<script src="data/feed.js"></script>\n<script src="data/seed.js"></script>#' $A/hub/index.html
  grep -c "seed.js" $A/hub/index.html
fi
