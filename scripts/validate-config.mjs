import { readBuildEnv,validateBuildEnv } from './env.mjs';
try{const result=validateBuildEnv(readBuildEnv());console.log(result.demo?'Explicit demo build enabled.':'Production Supabase configuration validated.');}catch(e){console.error(e.message);process.exitCode=1;}
