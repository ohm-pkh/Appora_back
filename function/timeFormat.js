export default function timeFormat(time){
    const arr = time.split(':');
    return arr[0]+':'+arr[1];
}