# Modern Authoring for Dynamic Assignment and Design of Cascading Style Sheets (MADADCSS)

MADADCSS is a pioneering project that explores innovative methods of CSS authoring by utilizing a minimalistic approach to dynamic and static stylesheets. Inspired by my university experiences with HTML and CSS, I sought to push the boundaries of conventional CSS usage by leveraging concepts like preprocessors and frameworks, aiming to reduce redundancy and enhance efficiency in web development.

## Structure

### Static CSS File
The static CSS file contains predefined classes that encapsulate a set of properties with expected values. This approach is particularly beneficial for properties with limited accepted values, such as `display`.

### Custom CSS File
The dynamic CSS file mirrors the structure of the static file but utilizes placeholders instead of hardcoded values. This allows for dynamic changes to properties like `color` and `font-size`, providing flexibility in design.

### JavaScript Tool
To bring this vision to life, I developed a JavaScript tool that reads a file with a specific extension, named `core.mess`. This file contains the classes defined in the CSS files. The tool:

- Identifies the relevant classes.
- Translates them into a functional CSS file.
- Seamlessly transfers the generated CSS to the browser.

This method eliminates the reliance on physically existing CSS files, enabling dynamic generation and transfer of CSS based on the user's requests.

## Future Directions

The experience of seeing the website respond to my changes has been incredibly rewarding. It has sparked new ideas, such as:

- Generating CSS output in a `.txt` file.
- Transitioning from **Express** to **Gulp** for project rebuilding.
- Exploring the handling of complex `@rules`.
