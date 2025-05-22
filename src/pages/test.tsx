import { useMagicalArrayMap, useMagicalObjectMap } from "@/utils/magicalMap";

export default function ExampleComponent() {
    const arrayMap = useMagicalArrayMap<string>();
    const userMap = useMagicalObjectMap(() => ({ name: '', age: 0 }));

    const addItem = (category: string, item: string) => {
        arrayMap[category].push(item);
    };

    const updateUser = (userId: string, updates: Partial<{ name: string; age: number }>) => {
        Object.assign(userMap[userId], updates);
    };

    return (
        <div>
            <button onClick={() => addItem('fruits', 'apple')}>
                Add Apple to Fruits
            </button>
            <button onClick={() => addItem('vegetables', 'carrot')}>
                Add Carrot to Vegetables
            </button>
            <button onClick={() => updateUser('user1', { name: 'John', age: 25 })}>
                Update User 1
            </button>

            <div>
                <h3>Arrays:</h3>
                {arrayMap.keys().map(key => (
                    <div key={key}>
                        {key}: {JSON.stringify(arrayMap[key])}
                    </div>
                ))}
            </div>

            <div>
                <h3>Users:</h3>
                {userMap.keys().map(key => (
                    <div key={key}>
                        {key}: {JSON.stringify(userMap[key])}
                    </div>
                ))}
            </div>

            <button onClick={() => arrayMap.clear()}>Clear Arrays</button>
            <button onClick={() => userMap.clear()}>Clear Users</button>
        </div>
    );
}
