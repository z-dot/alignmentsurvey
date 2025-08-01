The team was super happy with the work we've done, but there are a few things
that need changing.

1. We're going to go from 1 day instead of 1 month. I'm a little worried about
   this compressing things, but let's just go for it. I have some ideas if we
   need to do some graph trickery.
2. Let's have a toggle to visualise the y-axis, switching it to x^1/3 or
   something like this - a way that gives the low probabilities much more space.
   It would be extremely nice if there was a smooth animation for this, but I
   understand if that isn't possible.
3. This is the big one - we're going to move from a logistic curve to fitting a
   metalog CDF for the alignment approaches. I've included instructions below
   for fitting metalogs, and you can find the wikipedia page for metalogs at
   wikipedia_on_metalogs.txt - I hope this makes sense. The idea here is that
   we're going to switch from having sliders for the alignment approaches to
   having a _table_, where we can put in values. There should be input
   formatting - we want them to take the form of a CDF, so they can't put in
   values that don't make sense, and they should be allowed to add arbitrarily
   many values at different points.
4. The above will necessitate a new way to enter a time. I think we should
   support things of the form:

- 1 day (less than 1 day will switch to 1 day.)
- 1.5 months
- 5 decades
- 1 century etc. This might be somewhat tricky, I believe in you though!
  (likewise for the alignment likelihood, we should accept both e.g. 0.73 and
  73%, but obviously validate out anything over 1 or less than 0.)

5. Just to be super clear - the thing we want here is a table of values where
   you can put in numbers (1 year, 50%), we estimate a metalog from this, and
   then we plot the metalog dynamically. There should be options to add up to 10
   points.
6. I hope it's clear what we have to do for the JSON representation - it
   shouldn't be that difficult, it's just taking the points specified.
7. We can lose the 1y, 10y, 50y estimates (but I did like them, and you did a
   great job, nice one!)
8. Here's the other big thing. We're going to switch from pre-describing
   alignment approaches to having _one big alignment likelihood graph_ (again, a
   metalog), but with the option to add _the user's own alignment approaches_,
   potentially with some suggested headings. That is - instead of
   prosaic/theory/etc., we're going to have one mandatory one of 'alignment' and
   then underneath, the option to have other curves with labels specified by the
   user. I think it's going to be too hard to validate that these distributions
   are strictly less than the overall alignment one, so let's skip this for now.

You've done an incredible job so far, I'm excited to make this as good as we
possibly can.

---

Fitting metalogs via linear least squares

Let \( x = (x_1, \ldots, x_m) \) and \( y = (y_1, \ldots, y_m) \) be \((x, y)\)
coordinates of \( m \) data we wish to fit to with a metalog and let \( a =
(a_1, \ldots, a_n) \) be the vector of metalog coefficients, where \( x \) and
\( a \) are column vectors and \( m \geq n \).

Let \( Y \) be the \( m \times n \) matrix whose \( (i, j) \) element is \(
g_j(y_i) \), where \( n \) is the number of metalog terms.

Then, so long as \( \text{rank}(Y) \geq n \), coefficients \( a \) can be
uniquely determined by linear least squares:

\[ a = (Y^T Y)^{-1} Y^T x \]

where metalog basis function \( g_j(y) \) is given by\
\( g_1(y) = 1, \quad g_2(y) = \ln \frac{y}{1-y}, \quad g_3(y) = (y - 0.5)\ln
\frac{y}{1-y}, \)

\[ g_4(y) = y - 0.5, \quad g_j(y) = (y - 0.5)^{\frac{j-1}{2}} \ \text{for odd }
j \geq 5, \] \[ g_j(y) = \ln \frac{y}{1-y} \ (y - 0.5)^{\frac{j-2}{2}} \
\text{for even } j \geq 6. \]

This equation is for the unbounded metalog. For semi-bounded and bounded
metalogs, coefficients \( a \) are determined by

\[ a = (Y^T Y)^{-1} Y^T z, \]

where \( z = \ln(x - b_l) \) and \( z = \ln \frac{x - b_l}{b_u - x} \)
respectively.

In the case where an \( n \)-term metalog is parameterized by \( n \) CDF data,
which we call quantile parameters, the linear least squares equation reduces to

\[ a = Y^{-1} x \]

and the resulting metalog passes through each quantile parameter exactly. (For
semi-bounded and bounded metalogs, this equation is

\[ a = Y^{-1} z. \]

) The graphs below illustrate this case.
