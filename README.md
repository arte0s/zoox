<p align="center">
  <a href="https://arte0s.github.io/zoox">
    <a href="https://arte0s.github.io/zoox"><img src="https://arte0s.github.io/zoox/logo.svg" width="220" height="116" alt="Zoox logo"></a>
  </a>
</p>

# zoox.js

ZooxJS is a tiny framework for single file components

## Why

For fun and study =)

## Goals & Features

 - A lightweight and scalable
 - No dependencies
 - Control inheritance and encapsulation
 - Built-in internationalization

 ## Usage

#### Single-file components

1.Create your component in one html file with prefix `z-` (for example `z-my-button.html`)

```html
<html>

<head>
    <style>
        ...
    </style>

    <script>
        zxBase.onInit = () => {};

        zxBase.setCaption = t => {};
    </script>
</head>

<body>
    <button>
        <z-slot>default implementation</z-slot>
    </button>
</body>

</html>
```

2. Add framework to the page

```html
<script type="text/javascript" src="path/to/zoox.js"></script>
```

3. Add components to file

```html
<body>
    <z type="my-button">Button caption</z>
</body>
```
