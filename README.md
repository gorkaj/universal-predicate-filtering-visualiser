# Universal Predicate Filtering Visualiser

An interactive step-by-step visualiser for the **universal predicate filtering** problem class, 
developed alongside the thesis *On the Logical Classification of Computational Geometry Problems* (Aarhus University, 2026).

## How it works?

The visualiser lets you define any problem in the universal predicate filtering class by supplying three parameters:

- **k** — candidate arity (e.g. `k=2` means candidates are directed edges)
- **m** — witness arity (e.g. `m=1` means each witness is a single point)
- **P** — a first-order arithmetic predicate over the coordinates of `t` and `u`

Place domain points on the canvas, then step through the algorithm one witness test at a time. 
The visualiser shows which candidate is being tested (blue), which witness is being evaluated (amber)
and which candidates have passed all witnesses and form part of the solution (green).

## Deployment

Try out the tool: https://incredible-syrniki-ee930b.netlify.app/
