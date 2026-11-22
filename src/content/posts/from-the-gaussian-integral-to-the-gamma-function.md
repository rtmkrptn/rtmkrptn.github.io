---
title: From the Gaussian Integral to the Gamma Function
description: Two ways to evaluate the same integral, and the identity that comes
  out when you set them equal
date: 2026-11-22
draft: false
vaultSource: From the Gaussian Integral to the Gamma Function.md
---

The Gaussian integral $\int_{-\infty}^{\infty} e^{-t^2}\,dt$ is usually solved with one trick: square it and switch to polar coordinates. My goal was to see how far the same trick goes if the integrand gets a power of $t$ in front. What comes out is a relation between $\Gamma(x+1)$ and $\Gamma\left(\frac{x+1}{2}\right)$, and $\Gamma\left(\frac{1}{2}\right) = \sqrt{\pi}$ as a special case.

```desmos The bell curve
y=e^{-x^{2}}
```

## Why This Integral
Quick recap for those who may not be familiar with the topic. Let $X$ be a random variable that follows an unknown distribution $\mathcal{D}$ with mean $\mu$ and variance $\sigma^2$.

$$X \sim \mathcal{D}(\mu, \sigma^2)$$

Take $n$ samples of $X$ and average them. Whatever $\mathcal{D}$ is, the sample mean is normally distributed:

$$\bar{X} \sim \mathcal{N}\left(\mu, \frac{\sigma^2}{n}\right)$$

This is the central limit theorem. Strictly, it is true as $n$ goes to infinity; in practice $n > 30$ is considered enough. The normal distribution is built out of $e^{-t^2}$, so this integral sits under a large part of statistics.

## Adding a Power of $t$

$$I(k) = \int_0^\infty t^k e^{-t^2}\,dt, \qquad k \in (-1, \infty)$$

The lower bound is $0$ because $t^k$ is not real for negative $t$ and non-integer $k$. The bound on $k$ comes from the behaviour near $0$: there $e^{-t^2} \approx 1$, so the integrand behaves like $t^k$. For $k = -1$ that is $\frac{1}{t}$, and the integral diverges.

```desmos Drag k. At k = -1 the area near zero blows up.
k=1
y=x^{k}e^{-x^{2}}\left\{x>0\right\}
```

## Squaring It
Square the integral and write it as a product of two copies with different variables. Two single integrals become one double integral over the first quadrant.

$$I(k)^2 = \int_0^\infty x^k e^{-x^2}\,dx \cdot \int_0^\infty y^k e^{-y^2}\,dy = \int_0^\infty \int_0^\infty (xy)^k e^{-(x^2+y^2)}\,dx\,dy$$

Now switch to polar coordinates: $x = r\cos\theta$, $y = r\sin\theta$. The first quadrant is $r \in [0, \infty)$, $\theta \in [0, \frac{\pi}{2}]$, and $x^2 + y^2 = r^2$.

$$I(k)^2 = \int_0^{\pi/2} \int_0^\infty \left[r^2 \cos\theta \sin\theta\right]^k e^{-r^2}\, r\,dr\,d\theta$$

The extra $r$ before $dr$ is the Jacobian of the change of variables. It is easy to forget, and the whole result is wrong without it.

## Splitting It
The integrand is a product of a function of $\theta$ and a function of $r$, so the double integral splits into two single ones.

$$I(k)^2 = \int_0^{\pi/2} (\cos\theta \sin\theta)^k\,d\theta \cdot \int_0^\infty r^{2k+1} e^{-r^2}\,dr$$

**The angular part.** $\cos\theta \sin\theta = \frac{1}{2}\sin 2\theta$, then substitute $\varphi = 2\theta$:

$$\int_0^{\pi/2} (\cos\theta \sin\theta)^k\,d\theta = 2^{-k} \int_0^{\pi/2} \sin^k(2\theta)\,d\theta = 2^{-(k+1)} \int_0^\pi \sin^k\theta\,d\theta$$

**The radial part.** Substitute $u = r^2$, $du = 2r\,dr$. Then $r^{2k+1}\,dr = r^{2k} \cdot r\,dr = u^k \cdot \frac{du}{2}$:

$$\int_0^\infty r^{2k+1} e^{-r^2}\,dr = 2^{-1} \int_0^\infty u^k e^{-u}\,du$$

The integral on the right is the Gamma function:

$$\Gamma(s) = \int_0^\infty u^{s-1} e^{-u}\,du$$

so the radial part is $2^{-1}\,\Gamma(k+1)$. For natural $n$, $\Gamma(n+1) = n!$.

## Putting It Together

$$I(k)^2 = 2^{-(k+1)} \int_0^\pi \sin^k\theta\,d\theta \cdot 2^{-1}\,\Gamma(k+1) = 2^{-(k+2)}\,\Gamma(k+1) \int_0^\pi \sin^k\theta\,d\theta$$

Take the square root:

$$I(k) = 2^{-\left(\frac{k}{2}+1\right)} \sqrt{\Gamma(k+1)} \sqrt{\int_0^\pi \sin^k\theta\,d\theta}, \qquad k \in (-1, \infty)$$

For $k \in \mathbb{N}_0$ the Gamma function becomes a factorial:

$$I(k) = 2^{-\left(\frac{k}{2}+1\right)} \sqrt{k!} \sqrt{\int_0^\pi \sin^k\theta\,d\theta}$$

## The Direct Route
There is a shorter way to the same integral. Substitute $u = t^2$ straight away, $du = 2t\,dt$, $dt = \frac{du}{2t}$:

$$I(k) = \frac{1}{2} \int_0^\infty u^{\frac{k-1}{2}} e^{-u}\,du = \frac{1}{2}\,\Gamma\left(\frac{k+1}{2}\right)$$

## Setting Them Equal
Both are $I(k)$, so the two results are equal. Write $x$ for $k$:

$$2^{-1}\,\Gamma\left(\frac{x+1}{2}\right) = 2^{-\left(\frac{x}{2}+1\right)} \sqrt{\Gamma(x+1)} \sqrt{\int_0^\pi \sin^x\theta\,d\theta}$$

Multiply both sides by $2$:

$$\Gamma\left(\frac{x+1}{2}\right) = 2^{-\frac{x}{2}} \sqrt{\Gamma(x+1)} \sqrt{\int_0^\pi \sin^x\theta\,d\theta}$$

A quick check with $x = 1$: $\int_0^\pi \sin\theta\,d\theta = 2$, so the right side is $2^{-\frac{1}{2}} \cdot \sqrt{1} \cdot \sqrt{2} = 1 = \Gamma(1)$.

Now set $x = 0$. The power of two disappears, $\sin^0\theta = 1$, and $\Gamma(1) = 0! = 1$:

$$\Gamma\left(\frac{1}{2}\right) = \sqrt{\Gamma(1)} \sqrt{\int_0^\pi d\theta} = \sqrt{0!}\,\sqrt{\pi} = \sqrt{\pi}$$

The same value closes the loop: $I(0) = \frac{1}{2}\Gamma\left(\frac{1}{2}\right) = \frac{\sqrt{\pi}}{2}$, and since $e^{-t^2}$ is even, the Gaussian integral we started with is $\sqrt{\pi}$.
