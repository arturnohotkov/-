export const portable = false;

export function request(path, body) {
  const options = body === undefined ? {cache: 'no-store'} : {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body)
  };
  return fetch('/api/v1/' + path, options);
}
