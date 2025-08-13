invariants:

- table represents a valid (partial) cdf within the bounds of the graph
- displayed time/probability ~corresponds to internal values in [0, 1]^2
- internal state of table is sorted

we have four core operations one can do on the table:

1. change date
2. change prob
3. delete row
4. add row

let's go through each one. I'm going to use really rough descriptions here, but
I'd like this to be very functional, as much as we can manage.

## change date

1. store the row index (index_old) and old values of the row (as stored in
   state) as (x_old, y_old).
2. attempt to parse new date into years (parse function)
3. if parse fails, do not modify state, revert displayed text to correspond to
   internal value (revert function [?]) and return
4. clip new date to (mindate, maxdate) (clip function)
5. convert new date to unit-space [0,1] and store in new var x_new (now
   guaranteed it will lie in this range) (year-unit conversion function)
6. if new unitspace date already in the set of datapoints (accounting for
   precision errors), revert displayed text to correspond to internal value
   (revert function) and return
7. create a copy of the internal state of this table **without** the row being
   modified.
8. search (linear is fine for this number of datapoints) through that copied
   table for the x-values immediately preceding (x_i) and following (x_j) the
   new x-value (x_new). also store the index of the preceding, so you can insert
   more easily later.
9. check that y_i <= y_old <= y_j, (accounting for cases where x_new is the
   first or last value, meaning that you don't have to make comparisons). y_old
   is the original prob value corresponding to the row that was changed.
10. if the above check fails, set y_new = ((y_i if y_i else 0) + (y_j if y_j
    else 1)) / 2 (accounting for all the weirdness in js, I don't expect that to
    be grammatical). else, set y_new = y_old.
11. insert the new row (x_new, y_new) into the copied table (maintaining the
    sort). (you probably want a function for this)
12. replace state with the copied table.
13. call a function that handles everything else (updates the table, refits,
    redraws) (but it should only be _one_ function that handles all this!)

## change prob

1. attempt to parse prob
2. if parse fails, revert prob and return
3. new var prob_new = clipped new prob between value immediately preceding (or 0
   if doesn't exist) and value immediately following (or 1 if doesn't exist)
4. replace state with new table with prob_new in the same row.
5. call the function that handles everything else.

## delete row

1. if number of datapoints < 3, do nothing and return
2. update state without deleted row
3. call function that handles everything else.

## add row

1. if there's no datapoint at x=1
   1. then add a datapoint at x=1, y=1 to the table, call function to handle all
      else, return
2. if there's no datapoint at x=0
   1. then add a datapoint at x=0, y=0 to the table, call function to handle all
      else, return
3. take i = n // 2 and j = (n // 2) + 1
4. insert row with ((x_i + x_j) / 2, (y_i + y_j) / 2) (using existing function)
5. call function to handle all else, return
