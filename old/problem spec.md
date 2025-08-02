Hey Claude!

The idea is that we're going to write a web app that builds scaled cdfs from a
mixture of piecewise-linear distributions.

The background for this is that I want to - ultimately - build a graph
representing the likelihood that various alignment approaches 'work' compared to
the time spent working on them. But we need some data! So I'm going to solicit
some data from researchers and put together the final graph afterwards.

The idea here is similar to the way you enter numeric predictions into
Metaculus - specify some mixture of distributions with a lower quartile, upper
quartile, median, attach some weight to each distribution, and then show the
final product.

We're going to use d3 to show the distribution, using d3's curveMonotoneX to
smooth out the distributions (but retaining the locations of the knots of the
mixture distribution). I'm not cerrrrtain that this is the function we want to
use - I just really care about it being smooth, and not being too far away from
the actual, underlying piecewise-linear distribution - and I'm happy for your
takes.

A wrinkle is that the x-axis should be logarithmic, from a week to a century,
with ticks in the relevant places. This might be tricky! The way we're going to
get around this trickiness is by actually representing all the distributions as
within the unit square, and only displaying where they are on the logarithmic
scale. (That is - without transforming them! They'll look like regular
distributions in linear space.)

Another wrinkle is that there should be a scale for where this tops out - e.g.
you can set where the distribution ends (from 0% to 100%) that then scales the
mixture. This represents how likely it is that various alignment approaches work
in the limit.

Hope all this makes sense, lookin foward to chatting!
