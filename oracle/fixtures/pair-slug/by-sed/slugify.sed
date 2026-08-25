# Turns each line into a URL slug. Run it: sed -f slugify.sed
y/ABCDEFGHIJKLMNOPQRSTUVWXYZ/abcdefghijklmnopqrstuvwxyz/
s/[^a-z0-9]\{1,\}/-/g
s/^-//
s/-$//
/^$/d
