
const requestHeaders = {
  'Content-Type': 'application/json',
  'x-client-info': 'trollcity-web',
  'apikey': 'some-anon-key'
};

const optionsHeaders = {
  'Authorization': 'Bearer my-token'
};

Object.assign(requestHeaders, optionsHeaders);

console.log(requestHeaders);
