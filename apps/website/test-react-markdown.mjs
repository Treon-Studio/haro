import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

function Test() {
  return React.createElement(ReactMarkdown, {
    rehypePlugins: [rehypeHighlight],
    components: {
      code(props) {
        console.log("Children type:", typeof props.children, Array.isArray(props.children));
        if (Array.isArray(props.children)) {
            console.log("First child:", props.children[0]);
        }
        return React.createElement('code', props, String(props.children));
      }
    }
  }, '```python\nprint("Hello")\n```');
}

console.log(renderToStaticMarkup(React.createElement(Test)));
