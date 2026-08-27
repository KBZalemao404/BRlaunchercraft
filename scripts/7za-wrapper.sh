#!/bin/bash
# Wrapper around 7za that ignores symlink creation errors (darwin libs)
"C:\Users\Will\Documents\mine java e brk\node_modules\7zip-bin\win\x64\7za.exe" "$@"
exit 0
