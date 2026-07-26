// Builds the app against the ISOLATED test Supabase project instead of
// production, output to a separate folder the test suite loads from — so
// running tests can never touch real shop data no matter what a test does.
// Sets env vars (not npm script shell syntax) so this works identically on
// Windows and POSIX shells alike.
process.env.SUPABASE_URL = 'https://vnmlwxiwifzwjgbbhooy.supabase.co';
process.env.SUPABASE_ANON_KEY = 'sb_publishable_UY9WLveLkt_7e1JYoGV-og_h802Mlzp';
process.env.BUILD_OUT_DIR = 'tests/.test-build';

const { build } = require('./build.js');
build();
