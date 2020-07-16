// Make sure denominator values are not 0.
const checkDenom = (num) => {
	return num == 0 ? 1 : num;
}

const cloneObject = (obj) => {
	let newObj = JSON.parse(JSON.stringify(obj));
	obj = {};
	return newObj;
}

const cloneArray = (arr) => {
	let newArr = JSON.parse(JSON.stringify(arr));
	arr = [];
	return newArr;
}

module.exports = {
	checkDenom,
	cloneObject,
	cloneArray
}