// Local build-only fixture for Next's documented test hook. No committed source or downloaded fonts.
module.exports = {
  'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap': `/* latin */
@font-face {
  font-family: 'Noto Serif JP';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: local('Times New Roman');
}`,
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&display=swap': `/* latin */
@font-face {
  font-family: 'Cormorant Garamond';
  font-style: normal;
  font-weight: 400 600;
  font-display: swap;
  src: local('Times New Roman');
}`,
}
