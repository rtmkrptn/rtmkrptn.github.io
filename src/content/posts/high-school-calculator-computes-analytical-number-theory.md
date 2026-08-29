---
title: High School Calculator Computes Analytical Number Theory
description: Prime generating function without explicit if-statements,
  conditional functions, and advanced functions like mod, gcd
date: 2026-08-28
draft: false
vaultSource: High School Calculator Computes Analytical Number Theory.md
---

Most of the time Desmos is used to draw polynomials to find roots. However, not many people know how far you can go. This article is absolutely useless from **a** scientific point of view, yet it is interesting to trace how limitations force creativity. My goal was to build **a** prime generating function $f(1) = p_1 = 2$ without explicit `if` statements, conditional functions, and advanced functions like $\text{mod}$ and $\text{gcd}$.
## What Is a Prime Number?
Quick recap for those who may not be familiar with the topic. A prime number is a number that has no divisors besides one and itself. $1$ is excluded from the set of primes. 
## Is This an Integer?
My thought process was the following: to check whether a number is prime, we have to know **if** it has any divisors. If $a,b,\frac{a}{b} \in \mathbb{Z}$ then $b$ is **a** divisor of $a$. This method is based on knowing that **the** inputs and output are integers. So, let's build it.

$\cos(\pi x) = \pm 1$ when $x$ is an integer, everywhere else it's strictly between $-1$ and $1$. Take the absolute value, and integers give exactly $1$, everything else gives something strictly less than $1$. Discard everything after the decimal point (or floor **it**) and non-integers collapse to $0$.
$$Z(x) = \left\lfloor \, |\cos(\pi x)| \, \right\rfloor$$

```desmos The wave, and the switch it collapses to. Drag and zoom it.
y=\left|\cos\left(\pi x\right)\right|
Z\left(x\right)=\operatorname{floor}\left(\left|\cos\left(\pi x\right)\right|\right)
y=Z\left(x\right)
\left(\left[-10,...,10\right],Z\left(\left[-10,...,10\right]\right)\right)
```

$Z(x)$ is an "is this an integer" detector, built entirely out of trigonometry and a floor function. That's the whole trick.

## Divisibility Without Modulo

$$d(x,y) = Z(y) \cdot Z\!\left(\frac{x}{y}\right)$$

This says: $y$ is an integer, *and* $x/y$ is an integer. If both hold, $y$ divides $x$ cleanly. We just built a divisibility test without a single modulo operator. Interestingly, a third factor, $Z(x)$, is unnecessary. If $y$ and $x/y$ are both integers, $x = y \cdot (x/y)$ has to be too because an integer times another integer is just an integer.

## How Many?

$$D(x) = \sum_{n=2}^{x-1} d(x,n)$$

This counts divisors of $x$ strictly between $1$ and $x$. It is a specific design choice. I didn't want to map $2$ to $1$ (2 divisors are the number itself and $1$). $D(x) = 0$ exactly when $x$ has no divisors in that range, which for $x \ge 2$ is just the definition of prime. $D(7)=0$ (prime), $D(9)=1$, $D(4)=1$.

$$p(x) = \left\lfloor \frac{1}{1 + D(x)} \right\rfloor$$

This is an old trick. $\frac{1}{1}=1$ when $D(x_i)=0$, so $x_i$ is prime. **The** $D(x)$ range is $[0,\infty)$, therefore $\frac{1}{1+n}<1$ if $n>0$. Floor it and we get a boolean operator that outputs $1$ if $x$ is prime and $0$ if $x$ isn't prime.

One real edge case worth knowing about: $D(1)$ is an empty sum, so it's $0$ too. This means $p(1)=1$, falsely flagging $1$ as prime. It never causes a problem in my case because everywhere $p$ actually gets used, the sum starts at $n=2$, so $p(1)$ is never called. But it's a trap hidden in $p$ on its own.

## Brute Force Without Memory
$\sum_{n=2}^{k}p(n)=\pi(k)$, the count of primes up to $k$. Let's define an intermediate function $g(n,k)=n-\pi(k)$. Say, $n=3$, $\pi(4)=2$, $\pi(5)=3$. We can observe **that** the moment $k$ is $p_n$, $g(n,k)$ becomes $0$. Now take an absolute value to make sure it stays positive. 

$$f(n,k) = \left\lfloor \frac{1}{1 + \left|\, n - \pi(k) \,\right|} \right\rfloor$$

$f(n,k)$ is the same trick again: $1$ when $\pi(p_n)=n<\pi(p_{n+1})$. This is bad. $f(3,5)=f(3,6)=1$; we need to track the value of $k$ not when $f$ is $1$ but when $f$ changes. This is a simple discrete derivative: $\Delta_n(k)=f(n,k)-f(n,k-1)$. As soon as $k$ is $p_n$, $f(n,k)=1$, $f(n,k-1)=0$, so the difference is $1$. The **next** $k$ will evaluate both functions at $1$ and therefore the difference is $0$, as we wanted.

## Isolating $p_n$
$\Delta_n(k)$ tracks both rise and fall. Therefore, when $k$ becomes $p_{n+1}$, the difference evaluates at $-1$. In order to track when the positive change occurs, we construct a simple function: $\frac{1}{2-\Delta_n(k)}$; it evaluates at $1$ when $\Delta_n(k)=1$ and $1/3$ when $\Delta_n(k)=-1$. The last thing is to floor the expression so it equals $1$ exactly once when $k=p_n$.

$$p_n = \sum_{k=2}^{N} k \left\lfloor \frac{1}{2 - \Delta_n(k)} \right\rfloor$$

Sum from $k=2$ up to some $N$. Once the fraction is $1$ we multiply it by $k$, which is precisely $p_n$. Voila, we got **a** prime generating function from the simple idea of "is this an integer" detector.

## When to Stop
The interesting part is the upper bound $N$, which has to be sufficiently large to guarantee $p_n$ actually falls inside the range being summed.
$N = \left\lfloor n(\ln n + \ln \ln n) \right\rfloor$ is the real theorem (Rosser–Schoenfeld) but only proven to exceed $p_n$ for $n \ge 6$. $N = \left\lfloor n(\ln(n+1) + 2) \right\rfloor$ fixes the small cases but overcounts as $n$ goes further from $1$.
## The Actual Point

The same move gets reused at every layer here: build a test that's exactly $1$ at the one case you care about and $0$ everywhere else, then let a sum or a gate pick that one case out. Integer detector, divisibility test, divisor sum, prime function. None of the individual steps are hard, and each one is just the last idea reused. Give yourself `%` and a `for` loop and the whole chain is a few lines. Without them you **are** rebuilding most of elementary number theory from first principles.
