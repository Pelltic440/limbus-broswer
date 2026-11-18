(function () {
  var q = new URLSearchParams(location.search), u = q.get('u') || '', c = q.get('c') || '';
  var why = { ERR_NAME_NOT_RESOLVED: 'The address could not be found. Check the spelling.', ERR_INTERNET_DISCONNECTED: 'You appear to be offline.', ERR_CONNECTION_REFUSED: 'The site refused the connection.', ERR_CONNECTION_TIMED_OUT: 'The site took too long to answer.', ERR_CERT_AUTHORITY_INVALID: 'The site’s security certificate is not trusted.', ERR_CERT_DATE_INVALID: 'The site’s security certificate has expired.' };
  document.getElementById('why').textContent = why[c] || ('The browser could not open this page' + (c ? ' (' + c + ')' : '') + '.');
  document.getElementById('u').textContent = u;
  document.title = 'Page not available';
  document.getElementById('retry').addEventListener('click', function () { if (/^https?:\/\//i.test(u)) location.replace(u); else history.back(); });
})();
