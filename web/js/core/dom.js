/* Tiny DOM helpers. No framework, no build step — just hyperscript. */

const SVG_NS = "http://www.w3.org/2000/svg";

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

function append(node, children) {
  for (const child of children.flat(4)) {
    if (child == null || child === false || child === true) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function applyAttrs(node, attrs, svgMode) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class" || key === "className") {
      const list = Array.isArray(value) ? value.filter(Boolean) : [value];
      if (list.length) node.setAttribute("class", list.join(" "));
      continue;
    }
    if (key === "style") {
      if (typeof value === "string") {
        node.setAttribute("style", value);
        continue;
      }
      // Custom properties need setProperty; a plain object assignment ignores them.
      for (const [property, setting] of Object.entries(value)) {
        if (property.startsWith("--")) node.style.setProperty(property, setting);
        else node.style[property] = setting;
      }
      continue;
    }
    if (key === "html") {
      node.innerHTML = value;
      continue;
    }
    if (key === "text") {
      node.textContent = value;
      continue;
    }
    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
      continue;
    }
    if (!svgMode && key in node && typeof value !== "object") {
      node[key] = value;
      continue;
    }
    node.setAttribute(key, String(value));
  }
}

/** Hyperscript for HTML. */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  applyAttrs(node, attrs, false);
  return append(node, children);
}

/** Hyperscript for SVG. */
export function s(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs, true);
  return append(node, children);
}

export function clsx(...values) {
  return values.flat(3).filter(Boolean).join(" ");
}

/** Replace a container's content. */
export function mount(container, ...children) {
  clear(container);
  append(container, children);
  return container;
}

/** Fire a callback once the user's pointer leaves the element, or after a tick. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
}
